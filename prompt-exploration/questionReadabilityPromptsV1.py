#%%
# Import libraries
import dspy
from dspy.teleprompt import BootstrapFewShot
from dspy.teleprompt import BootstrapFewShotWithRandomSearch
from dspy.evaluate.evaluate import Evaluate
from dspy.teleprompt import SignatureOptimizer
import json

import os

from dotenv import load_dotenv

load_dotenv()
gpt3_5_open_ai_api_key = os.getenv("OPENAI_API_KEY")

#%%
# Set up the LM (https://dspy-docs.vercel.app/api/language_model_clients/OpenAI)
gpt3_turbo = dspy.OpenAI(model='gpt-3.5-turbo', max_tokens=500, api_key=gpt3_5_open_ai_api_key)  
dspy.configure(lm=gpt3_turbo)

# %%
# Create a class-based DSPy Signature to assess readability of a question

input_description = """The question to classify. The input will be a JSON with the following structure:
        {
            "response_format": "open" or "closed",
            "description": string,
            "main_text": string,
            "response_categories": empty list or list of JSONs with an "id" and "text" field
        }"""

# output_description = """The readability of the question. The output will be a JSON with the following structure:
#         {
#             "readability": "low", "medium", or "high"
#         }"""

output_description = """The readability of the question. Only output one of the following strings: "low", "medium", or "high". Don't include any other information in the output."""

class AssessReadability(dspy.Signature):
    """Assess the readbility of a question to high, medium, or low. Keep in mind the following qualities, for a question to be readable:
        (1) Question should meet a third-grade reading level.
        (2) Question should not contain basic spelling or grammar mistakes.
        (3) Question should be concise.
        (4) Question should not contain potential jargon (e.g. special words or expressions that are used by a particular profession or group and are difficult for others to understand) that are not defined.
        (5) Question should not contain any acronyms that are not defined.
        (6) Question should not mention proper nouns (e.g. names of specific people, places, or organizations) without describing what they are.
        (7) Question should be in active voice.
        (8) Question should have as few propositions and logical operators as possible.
        (9) Question should not have negatives or double negatives."""

    # question = dspy.InputField(desc="The question to assess.")
    question = dspy.InputField(desc=input_description)
    reading_level = dspy.InputField(desc="The reading level to assess the question against.")
    readability = dspy.OutputField(desc=output_description)

# %%
# Test out AssessReadability
    
reading_level = "third grade"

# defining the predictor
readability = dspy.ChainOfThought(AssessReadability)

# %%
# defining the input
test_inputs = [
    {
        "response_format": "open",
        "description": "",
        "main_text": "What is your age?",
        "response_categories": []
    },
    {
        "response_format": "closed",
        "description": "",
        "main_text": "Do you think military security is more important and should have more budget allocation than social security?",
        "response_categories": [
            {"id": 0, "text": "Yes"},
            {"id": 1, "text": "No"}
        ]
    },
    {
        "response_format": "closed",
        "description": "",
        "main_text": "Do you like ice cream?",
        "response_categories": [
            {"id": 0, "text": "Yes"},
            {"id": 1, "text": "No"}
        ]
    },
    {
        "response_format": "closed",
        "description": "",
        "main_text": "Has the externality of market deregulation been taken care of?",
        "response_categories": [
            {"id": 0, "text": "Yes"},
            {"id": 1, "text": "No"}
        ]
    },
    {
        "response_format": "closed",
        "description": "",
        "main_text": "How often do you eat ice cream?",
        "response_categories": [
            {"id": 0, "text": "Every day"},
            {"id": 1, "text": "Once a week"},
            {"id": 2, "text": "Once a month"},
            {"id": 3, "text": "Never"}
        ]
    }
]

# %%

# running the predictor
for test_input in test_inputs:
    # stringify the input
    # test_input_str = json.dumps(test_input)
    test_input_str = test_input["main_text"]
    result = readability(question=test_input_str, reading_level=reading_level)
    rationale = result.rationale
    readability_score = result.readability
    print(f"The readability of the question '{test_input["main_text"]}' is {readability_score}. The rationale is: {rationale}.") 
# %%
# Create a module from AssessReadability

class AssessReadabilityModule(dspy.Module):
    
    def __init__(self):

        super().__init__()

        self.readability = dspy.ChainOfThought(AssessReadability)

    def forward(self, question, reading_level):

        # this needs to return a dict and not a string for Evaluate to work
        return self.readability(question=question, reading_level=reading_level)

# %%

# Load the training data
with open('generated_questions/readability_outputs_train.json', 'r') as f:
    train_data = json.load(f)    

# iterate through the data and construct a DSPy Example
trainset = []
for item in train_data:
    # # set the description field to an empty string
    # item["question"]["description"] = ""
    # stringify the input
    question_str = json.dumps(item["question"])
    # question_str = item["question"]["main_text"]
    trainset.append(dspy.Example(question=question_str, readability=item["readability"], reading_level="third grade").with_inputs("question", "reading_level"))   

# Load the validation data
with open('generated_questions/readability_outputs_val.json', 'r') as f:
    val_data = json.load(f)

# iterate through the data and construct a DSPy Example
valset = []
for item in val_data:
    # set the description field to an empty string
    item["question"]["description"] = ""
    # stringify the input
    question_str = json.dumps(item["question"])
    # question_str = item["question"]["main_text"]
    valset.append(dspy.Example(question=question_str, readability=item["readability"], reading_level="third grade").with_inputs("question", "reading_level")) 
# %%
print(len(trainset), len(valset))
valset[0].question
# %% 
# Create a metric
def validate_readability(example, pred, trace=None):
    # print(example.readability, type(example.readability))
    # print(pred.readability, type(pred.readability))

    # # convert strings to numbers
    # true_score = float(example.readability)
    # pred_score = float(pred.readability)

    # # categorize the scores to "low" if < 0.5, "medium" if 0.5 <= score < 0.8, and "high" if >= 0.8
    # true_category = ""
    # pred_category = ""

    # if true_score < 0.5:
    #     true_category = "low"
    # elif true_score >= 0.5 and true_score < 0.8:
    #     true_category = "medium"
    # else:
    #     true_category = "high"

    # if pred_score < 0.5:
    #     pred_category = "low"
    # elif pred_score >= 0.5 and pred_score < 0.8:
    #     pred_category = "medium"
    # else:
    #     pred_category = "high"

    # print(example.readability, pred.readability)
    # assert example.readability.lower() in ["low", "medium", "high"]
    # assert pred.readability.lower() in ["low", "medium", "high"]

    if pred.readability.lower() not in ["low", "medium", "high"]:
        # another way of finding the category
        pred_category = ""
        if "low" in pred.readability.lower():
            pred_category = "low"
        elif "medium" in pred.readability.lower():
            pred_category = "medium"
        elif "high" in pred.readability.lower():
            pred_category = "high"
        else:
            return False
        
        return example.readability.lower() == pred_category

    return example.readability.lower() == pred.readability.lower()

    # # load pred.readability into json
    # try:
    #     pred_json = json.loads(pred.readability)
    #     return example.readability.lower() == pred_json["readability"].lower()
    # except:
    #     # the output wasn't a JSON
    #     print(f"Error: {pred.readability} is not a JSON.")
    #     # another way of finding the category
    #     pred_category = ""
    #     if "low" in pred.readability.lower():
    #         pred_category = "low"
    #     elif "medium" in pred.readability.lower():
    #         pred_category = "medium"
    #     elif "high" in pred.readability.lower():
    #         pred_category = "high"
    #     else:
    #         return False

    #     return example.readability.lower() == pred_category

# %%
non_optimized_readability_program = AssessReadabilityModule()

# %%
# Optimize the module. I will be using BootstrapFewShot

# set up optimizer (repeat 10 times)
config = dict(max_bootstrapped_demos=3, max_labeled_demos=5, max_rounds=2, max_errors=5)
# max_bootstrapped_demos: Refers to the maximum number of demonstrations that will be bootstrapped. Bootstrapping in this context likely means generating new training examples based on the predictions of a teacher module or some other process
# max_labeled_demos: Refers to the maximum number of labeled demonstrations (examples) that will be used for training the student module directly

fewshot_optimizer = BootstrapFewShot(metric=validate_readability, **config)
optimized_readability_program1 = fewshot_optimizer.compile(AssessReadabilityModule(), trainset=trainset)

# %%
# Optimize the module with BootstrapFewShotWithRandomSearch
# Applies BootstrapFewShot several times with random search over generated demonstrations, and selects the best program
fewshot_optimizer = BootstrapFewShotWithRandomSearch(metric=validate_readability, max_bootstrapped_demos=2, num_candidate_programs=8, num_threads=1)
optimized_readability_program2 = fewshot_optimizer.compile(student = AssessReadabilityModule(), trainset=trainset, valset=valset)

# %% 
# Attempt to optimize with SignatureOptimizer
sig_optimizer = SignatureOptimizer(metric=validate_readability, verbose=False)

kwargs = dict(num_threads=64, display_progress=True, display_table=0)

optimized_readability_program3 = sig_optimizer.compile(AssessReadabilityModule(), devset=trainset, eval_kwargs=kwargs)

# %%
# load the old optimized program 
# optimized_readability_program2_old = AssessReadabilityModule()    
# optimized_readability_program2_old.load('compiled_modules/assess_readability_few_shot_search_old.json')

# optimized_readability_program1_old = AssessReadabilityModule()    
# optimized_readability_program1_old.load('compiled_modules/assess_readability_few_shot_old.json')
# %%
# Evaluate the optimized program

evaluate_program = Evaluate(devset=valset, num_threads=1, display_progress=True, display_table=5)

evaluate_program(optimized_readability_program2, metric=validate_readability)

# %%
# Let's look at the model history
gpt3_turbo.inspect_history(n=1)

# %% 
# Let's save the optimized programs
# non_optimized_readability_program.save('compiled_modules/assess_readability_non_optimized.json')
# optimized_readability_program1.save('compiled_modules/assess_readability_few_shot_no_desc.json')
# optimized_readability_program2.save('compiled_modules/assess_readability_few_shot_search_no_desc.json')

# %%
# Create another class-based DSPy Signature (re-write a question based on rationale)
    
input_description = """The question to classify. The input will be a JSON with the following structure:
    {
        "response_format": "open" or "closed",
        "description": string,
        "main_text": string,
        "response_categories": empty list or list of JSONs with an "id" and "text" field
    }"""

output_description = """The re-written question. The output will be a JSON with the following structure:
    {
        "response_format": "open" or "closed",
        "description": string,
        "main_text": string,
        "response_categories": empty list or list of JSONs with an "id" and "text" field
    }"""
    
class RewriteQuestion(dspy.Signature):
    """Rewrite a question to address the issues identified in the input_rationale."""

    question = dspy.InputField(desc=input_description)
    input_rationale = dspy.InputField(desc="The rationale for a question's readability. It may contain a mix of positive and negative feedback.")
    rewritten_question = dspy.OutputField(desc=output_description)

# %%
# Test out the class-based DSPy Signature
rewrite = dspy.ChainOfThought(RewriteQuestion)

# running the predictor
for test_input in test_inputs:
    # stringify the input
    # test_input_str = json.dumps(test_input)
    test_input_str = test_input["main_text"]
    result = readability(question=test_input_str, reading_level=reading_level)
    rationale = result.rationale
    readability_score = result.readability
    print(f"The original question is: {test_input_str}.")
    print(f"The readability is {readability_score}.")
    print(f"The rationale is: {rationale}.")
    if float(readability_score) < 0.5:
        test_input_str2 = json.dumps(test_input)
        result2 = rewrite(question=test_input_str2, input_rationale=rationale)
        print(f"The re-written question is: {result2.rewritten_question}.")
        print(f"The rationale is: {result2.rationale}.")
    else:
        print("The question is already readable.")

# %%

# Create a Module with optimized_readability_program2 and RewriteQuestion

class AssessReadabilityAndRewrite(dspy.Module):
    
    def __init__(self, optimized_readability_program):

        super().__init__()

        self.readability = optimized_readability_program

        self.rewrite = dspy.ChainOfThought(RewriteQuestion)

    def forward(self, question, reading_level):

        result = self.readability(question=question, reading_level=reading_level)

        readability_score = result.readability
        input_rationale = result.rationale

        assert readability_score in ["low", "medium", "high"]

        if readability_score == "low":
            return self.rewrite(question=question, input_rationale=input_rationale).rewritten_question
        else:
            return question

# %%
# Test out AssessReadabilityAndRewrite

# create the module object
assess_readability_and_rewrite = AssessReadabilityAndRewrite(optimized_readability_program2)

for test_input in test_inputs:
    # stringify the input
    test_input_str = json.dumps(test_input)
    # test_input_str = test_input["main_text"]
    rewritten_question = assess_readability_and_rewrite(question=test_input_str, reading_level="third grade")
    print(f"The original question is: {test_input_str}.")
    print(f"The re-written question is: {rewritten_question}.")


# %%
# Let's save the complete program --> not necessary
# assess_readability_and_rewrite.save('compiled_modules/assess_readability_and_rewrite.json')
# %%
# Let's load the programs
assess_readability = AssessReadabilityModule()    
assess_readability.load('compiled_modules/assess_readability_few_shot_search.json')

assess_readability_and_rewrite = AssessReadabilityAndRewrite(assess_readability)
# %%
# Let's run the program on some of my own examples

test_inputs = [
    {
        "question":{
            "response_format": "closed",
            "description": "",
            "main_text": "Do you think military security is more important and should have more budget allocation than social security?",
            "response_categories": [
                {"id": 0, "text": "Yes"},
                {"id": 1, "text": "No"}
            ],
        },
        "readability": "medium"
    },
    {
        "question":{
            "response_format": "closed",
            "description": "",
            "main_text": "Do you agree or disagree with the following statement? The social discrepancies in Germany will certainly continue to exist.",
            "response_categories": [
                {"id": 0, "text": "Yes"},
                {"id": 1, "text": "No"}
            ],
        },
        "readability": "medium"
    },
    {
        "question":{
            "response_format": "closed",
            "description": "",
            "main_text": "Do you agree or disagree with the following statement? The social differences in Germany will certainly continue to exist.",
            "response_categories": [
                {"id": 0, "text": "Yes"},
                {"id": 1, "text": "No"}
            ],
        },
        "readability": "high"
    },
    {
        "question":{
            "response_format": "closed",
            "description": "",
            "main_text": "Do you think the increase in the rate of immigration, controlling for the economy, is higher or lower than the increase in the rate of crime in your area?",
            "response_categories": [
                {"id": 0, "text": "Yes"},
                {"id": 1, "text": "No"}
            ],
        },
        "readability": "medium"
    },
    {
        "question":{
            "response_format": "closed",
            "description": "",
            "main_text": "Do you favor or oppose requiring states to have 60% of the approval of voters to raise state taxes?",
            "response_categories": [
                {"id": 0, "text": "Favor"},
                {"id": 1, "text": "Oppose"}
            ],
        },
        "readability": "high"
    },
    {
        "question":{
            "response_format": "closed",
            "description": "",
            "main_text": "Do you favor or oppose not allowing the state to raise state taxes without approval of 60% of voters?",
            "response_categories": [
                {"id": 0, "text": "Favor"},
                {"id": 1, "text": "Oppose"}
            ],
        },
        "readability": "medium"
    },
    {
        "question":{
            "response_format": "closed",
            "description": "",
            "main_text": "Should your local government not raise taxes? Should not the government never have offered abortion license?",
            "response_categories": [
                {"id": 0, "text": "Yes"},
                {"id": 1, "text": "No"}
            ],
        },
        "readability": "low"
    },
    {
        "question":{
            "response_format": "closed",
            "description": "",
            "main_text": "Has the externality of market deregulation been taken care of?",
            "response_categories": [
                {"id": 0, "text": "Yes"},
                {"id": 1, "text": "No"}
            ],
        },
        "readability": "low"
    },
    {
        "question":{
            "response_format": "closed",
            "description": "",
            "main_text": "Did the government handle negative impacts of ending food subsidy well?",
            "response_categories": [
                {"id": 0, "text": "Yes"},
                {"id": 1, "text": "No"}
            ],
        },
        "readability": "high"
    },
    {
        "question":{
            "response_format": "closed",
            "description": "",
            "main_text": "Do you support or oppose tort reform?",
            "response_categories": [
                {"id": 0, "text": "Support"},
                {"id": 1, "text": "Oppose"}
            ],
        },
        "readability": "low"
    },
    {
        "question":{
            "response_format": "closed",
            "description": "",
            "main_text": "Should people held on terror related crimes have the right of habeas corpus?",
            "response_categories": [
                {"id": 0, "text": "Yes"},
                {"id": 1, "text": "No"}
            ],
        },
        "readability": "low"
    },
    {
        "question":{
            "response_format": "closed",
            "description": "",
            "main_text": "Are you very likely, somewhat likely, somewhat unlikely, or very unlikely to hire a tax preparer next year?",
            "response_categories": [
                {"id": 0, "text": "Very unlikely"},
                {"id": 1, "text": "Somewhat unlikely"},
                {"id": 2, "text": "Somewhat likely"},
                {"id": 3, "text": "Very likely"}
            ],
        },
        "readability": "medium"
    },
    {
        "question":{
            "response_format": "closed",
            "description": "",
            "main_text": "How likely or unlikely are you to hire a tax preparer next year?",
            "response_categories": [
                {"id": 0, "text": "Very unlikely"},
                {"id": 1, "text": "Somewhat unlikely"},
                {"id": 2, "text": "Somewhat likely"},
                {"id": 3, "text": "Very likely"}
            ],
        },
        "readability": "high"
    },
]

# %%

# running the predictor
for test_input in test_inputs:
    # stringify the input
    test_input_str = json.dumps(test_input)
    # test_input_str = test_input["main_text"]
    result = assess_readability(question=test_input_str, reading_level="third grade")
    rationale = result.rationale
    readability_score = result.readability
    print(f"The question is: '{test_input["main_text"]}'") 
    print(f"The predicted readability is {readability_score}. The actual readability is {test_input['readability']}.")
    print(f"The rationale is: {rationale}.")
    print()
    print()
# %%
gpt3_turbo.inspect_history(n=1)
# %%
