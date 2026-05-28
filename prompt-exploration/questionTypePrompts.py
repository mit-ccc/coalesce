#%%
# Import libraries
import dspy
from dspy.teleprompt import BootstrapFewShot
from dspy.teleprompt import BootstrapFewShotWithRandomSearch
from dspy.evaluate.evaluate import Evaluate
from dspy.evaluate.metrics import answer_exact_match
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
# Create a class-based DSPy Signature to assess the question type

input_description = """The question to classify. The input will be a JSON with the following structure:
        {
            "response_format": "open" or "closed",
            "description": string,
            "main_text": string,
            "response_categories": empty list or list of JSONs with an "id" and "text" field
        }"""

output_description = """The question type. The output will be a JSON with the following structure:
        {
            "question_type": "demographic", "attitudinal", or "behavioral"
        }"""

class ClassifyQuestionType(dspy.Signature):
    """Classify the question type. There are three types of questions: demographic, attitudinal, and behavioral.
       Demographic questions ask about the personal background of respondents.
       Attitudinal questions ask about respondents' personal perceptions and opinions on different topics.
       Behavioral questions ask for data on the frequency and way in which particular actions are performed.
    """
    question = dspy.InputField(desc=input_description)
    question_type = dspy.OutputField(desc=output_description)
# %%
# Test out ClassifyQuestionType

# defining the predictor
question_type = dspy.ChainOfThought(ClassifyQuestionType)

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
        "main_text": "Do you like ice cream?",
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

# running the predictor
for test_input in test_inputs:
    # stringify the input
    test_input_str = json.dumps(test_input)
    print(question_type(question=test_input_str))
# %%
# Check the model history
gpt3_turbo.inspect_history(n=5)
# %%
# The signature works pretty well. I'll create a module now
class ClassifyQuestionTypeModule(dspy.Module):
    
    def __init__(self):

        super().__init__()

        self.question_type = dspy.ChainOfThought(ClassifyQuestionType)

    def forward(self, question):

        # this needs to return a dict and not a string for Evaluate to work
        return self.question_type(question=question)
    
# %%
# Load the train data
with open('generated_questions/question_type_outputs_train.json', 'r') as f:
    train_data = json.load(f)

# iterate through the data and construct a DSPy Example
trainset = []
for item in train_data:
    # stringify the input
    question_str = json.dumps(item["question"])
    trainset.append(dspy.Example(question=question_str, question_type=item["question_type"]).with_inputs("question"))    

# Load the validation data
with open('generated_questions/question_type_outputs_val.json', 'r') as f:
    val_data = json.load(f)

# iterate through the data and construct a DSPy Example
valset = []
for item in val_data:
    # stringify the input
    question_str = json.dumps(item["question"])
    valset.append(dspy.Example(question=question_str, question_type=item["question_type"]).with_inputs("question"))

# %%
# Create a metric
    
def validate_question_type(example, pred, trace=None):
    # print(example)
    # print(pred)
    return example.question_type.lower() == pred.question_type.lower()

# %%

# Optimize the module. I will be using BootstrapFewShot

# set up optimizer (repeat 10 times)
config = dict(max_bootstrapped_demos=3, max_labeled_demos=5, max_rounds=2, max_errors=5)
# max_bootstrapped_demos: Refers to the maximum number of demonstrations that will be bootstrapped. Bootstrapping in this context likely means generating new training examples based on the predictions of a teacher module or some other process
# max_labeled_demos: Refers to the maximum number of labeled demonstrations (examples) that will be used for training the student module directly

fewshot_optimizer = BootstrapFewShot(metric=validate_question_type, **config)
optimized_program1 = fewshot_optimizer.compile(ClassifyQuestionTypeModule(), trainset=trainset)

# %%
    
# Optimize the module. I will be using BootstrapFewShotWithRandomSearch
# Applies BootstrapFewShot several times with random search over generated demonstrations, and selects the best program
fewshot_optimizer = BootstrapFewShotWithRandomSearch(metric=validate_question_type, max_bootstrapped_demos=2, num_candidate_programs=8, num_threads=1)
optimized_program2 = fewshot_optimizer.compile(student = ClassifyQuestionTypeModule(), trainset=trainset, valset=valset)

# %%
# Evaluate the optimized program

evaluate_program = Evaluate(devset=valset, num_threads=1, display_progress=True, display_table=15)
# evaluate_program(optimized_program1, metric=validate_question_type)
# For BootStrapFewShot: Average Metric: 18 / 18  (100.0%)

evaluate_program(optimized_program2, metric=validate_question_type)
# For BootstrapFewShotWithRandomSearch: Average Metric: 18 / 18  (100.0%)
# %%
# Let's look at the model history
gpt3_turbo.inspect_history(n=1)
# NOTE: I like the prompts for optimized_program2 better than optimized_program1, so I'm going with that
# %% 
# Let's save the optimized programs
# optimized_program1.save('compiled_modules/classify_question_type_few_shot.json')
# optimized_program2.save('compiled_modules/classify_question_type_few_shot_search.json')
# %%
