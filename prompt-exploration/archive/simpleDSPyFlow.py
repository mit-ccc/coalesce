# Test out DSPy

#%%
# Import libraries
import dspy
from dspy.teleprompt import BootstrapFewShot
from dspy.evaluate.evaluate import Evaluate

#%%
# Set up the LM
gpt3_turbo = dspy.OpenAI(model='gpt-3.5-turbo-1106', max_tokens=300)  
dspy.configure(lm=gpt3_turbo)

#%%
# Try out a simple DSPy Signature
sentence = "it's a charming and often affecting journey."  # example from the SST-2 dataset.

classify = dspy.Predict('sentence -> sentiment')
classify(sentence=sentence).sentiment

# %%
# Create a class-based DSPy Signature (assess readability of a question)
class AssessReadability(dspy.Signature):
    """Assess the readbility of a question."""

    question = dspy.InputField(desc="The question to assess.")
    readability = dspy.OutputField(desc="The readability of the question as a score from 0 to 1 where 0 means poor readability and 1 means great readability.")

# %%
# Test out the class-based DSPy Signature

# defining the predictor
readability = dspy.ChainOfThought(AssessReadability)

complex_question1 = "How do the interplay between baryonic and non-baryonic dark matter constituents, the implications of emergent phenomena such as gravitational lensing and galactic rotational curves, and the methodological challenges inherent in detecting and characterizing these elusive particles contribute to our understanding of the universe's composition and evolutionary trajectory?"
simple_question1 = "How do dark matter and its effects help us understand the universe?"

for question in [complex_question1, simple_question1]:
    result = readability(question=question)
    rationale = result.rationale
    readability_score = result.readability
    print(f"The readability of the question '{question}' is {readability_score}. The rationale is: {rationale}.")

# It looks pretty good! It gave the complex question a score of 0.2, and the simple_question a score of 1
# %%
# Create another class-based DSPy Signature (re-write a question based on readability)
class RewriteQuestion(dspy.Signature):
    """Rewrite a question if the readability is less than 0.5. Return the original question if the readability is 0.5 or greater."""

    question = dspy.InputField(desc="The question that may be re-written.")
    readability = dspy.InputField(desc="The readability of the question as a score from 0 to 1 where 0 means poor readability and 1 means great readability.")
    rewritten_question = dspy.OutputField(desc="The rewritten question.")

# %%
# Test out the class-based DSPy Signature
rewrite = dspy.ChainOfThought(RewriteQuestion)

for question in [complex_question1, simple_question1]:
    readability_score = readability(question=question).readability
    rewrite_result = rewrite(question=question, readability=readability_score)
    print(f"The original question is: '{question}'. The readability score is: {readability_score}. The rewritten question is: '{rewrite_result.rewritten_question}'.")
    print(f"The rationale for the rewrite is: {rewrite_result.rationale}.")

# %%
# I want to create a module that combines the AssessReadability and RewriteQuestion signatures

class AssessReadabilityAndRewrite(dspy.Module):
    
    def __init__(self):

        super().__init__()

        self.readability = dspy.ChainOfThought(AssessReadability)

        self.rewrite = dspy.ChainOfThought(RewriteQuestion)

    def forward(self, question):

        readability_score = self.readability(question=question).readability

        if float(readability_score) < 0.5: # I could technically add this logic here instead of in the RewriteQuestion signature
            return self.rewrite(question=question, readability=readability_score).rewritten_question
        else:
            return question
        
# %%
# Create the data to optimize the module
# I used Chat-GPT to generate these questions and re-writes
train_data = [
    ("What is the capital of France?", "What is the capital of France?"),
    ("How many legs does a cat have?", "How many legs does a cat have?"),
    ("Who wrote \"Romeo and Juliet\"?", "Who wrote \"Romeo and Juliet\"?"),
    ("What color is the sky on a clear day?", "What color is the sky on a clear day?"),
    ("What is the main ingredient in a cheeseburger?", "What is the main ingredient in a cheeseburger?"),
    ("How does the phenomenon of quantum entanglement challenge classical notions of locality and realism within the framework of quantum mechanics?", "What is quantum entanglement and how does it affect particles?"),
    ("In what ways does the doctrine of judicial precedent influence the development and interpretation of common law systems, particularly in contrast to civil law jurisdictions?", "How does the idea of judicial precedent impact how laws are made and understood?"),
    ("What are the socio-economic factors contributing to income inequality within urban centers, and how do these disparities manifest in access to education, healthcare, and housing?", "Why do some people in cities have more money than others, and how does this affect their access to important things like education and healthcare?"),
    ("How do advances in artificial intelligence and machine learning algorithms facilitate the optimization of complex systems in fields ranging from finance and healthcare to transportation and energy management?", "How do computers get better at doing things like helping doctors and managing money?"),
    ("What are the philosophical implications of the theory of relativity for our understanding of time, space, and the nature of reality, and how do these concepts resonate with everyday experiences?", "What does Einstein's theory of relativity mean for how we think about time and space in our daily lives?")
]

# iterate through the data and construct a DSPy Example
trainset = []
for question, rewritten_question in train_data:
    trainset.append(dspy.Example(question=question, rewritten_question=rewritten_question).with_inputs("question"))

# print(trainset[0])
# print(trainset[0].question, trainset[0].rewritten_question)

# Do a similar thing for the devset
validation_data = [
    ("How do sociocultural constructs shape the formation and perpetuation of gender roles and stereotypes, and what are the implications of these dynamics on individuals' behavior and societal norms?", "How do people learn what they're supposed to do based on whether they're a boy or a girl?"),
    ("What did Einstein say about how space, time, and gravity work?", "What did Einstein say about how space, time, and gravity work?"),
    ("What are the ethical considerations surrounding the use of gene-editing technologies such as CRISPR-Cas9 in humans, particularly in the context of germline editing and potential societal implications?", "Is it okay to change people's genes to make them healthier?"),
    ("Why do some things cost more money than others, and why can't everyone always afford them?", "Why do some things cost more money than others, and why can't everyone always afford them?")
]

devset = []
for question, rewritten_question in validation_data:
    devset.append(dspy.Example(question=question, rewritten_question=rewritten_question).with_inputs("question"))

# %%
# Create the metric to optimize the module
# I want to make sure the re-written question is at least 0.5 readability and the length should be less than the original question (if it was re-written)
def validate_rewritten_question(example, pred, trace=None):
    # example is the Example object
    # pred is the rewritten_question (str)
    # check the answer match
    answer_match = example.rewritten_question.lower() == pred.lower()
    # print(f"Answer match: {answer_match}")
    # check the readability (called an outside signature, not sure if that's okay)
    readability_score = readability(question=pred).readability
    readability_match = float(readability_score) >= 0.5
    # print(f"Readability match: {readability_match}")
    # check the length
    length_match = len(pred) <= len(example.question)
    # print(f"Length match: {length_match}")

    if trace is None: # if we're doing evaluation or optimization
        return (int(answer_match) + int(readability_match) + int(length_match)) / 3
    else: # if we're doing bootstrapping, i.e. self-generating good demonstrations of each step
        return answer_match and readability_match and length_match

# %%
# Optimize the module. I will be using BootstrapFewShot because I have very little data
# About BootstrapFewShot: Uses your program to self-generate complete demonstrations for every stage of your program. 
    # Will simply use the generated demonstrations (if they pass the metric) without any further optimization

# set up optimizer (repeat 10 times)
config = dict(max_bootstrapped_demos=3, max_labeled_demos=5, max_rounds=2, max_errors=5)
# max_bootstrapped_demos: Refers to the maximum number of demonstrations that will be bootstrapped. Bootstrapping in this context likely means generating new training examples based on the predictions of a teacher module or some other process
# max_labeled_demos: Refers to the maximum number of labeled demonstrations (examples) that will be used for training the student module directly

teleprompter = BootstrapFewShot(metric=validate_rewritten_question, **config)
optimized_program = teleprompter.compile(AssessReadabilityAndRewrite(), trainset=trainset)

# %%
# Test the optimized program

for question in [complex_question1, simple_question1]:
    print(f"The original question is: '{question}'. The re-written question is: '{optimized_program(question)}'.")

# %%
# Evaluate the optimized program
# NOTE: the evaluation keeps erroring when generating the table. I'm not sure why. I'll just use a for loop
evaluate_program = Evaluate(devset=devset, num_threads=1, display_progress=True, display_table=3)
evaluate_program(optimized_program, metric=validate_rewritten_question)

# %%
# Let's inspect the last prompt
gpt3_turbo.inspect_history(n=5)

# %%
# Let's save the optimized program
optimized_program.save('compiled_assess_readability_and_rewrite.json')

# %%
# Let's load the optimized program
loaded_program = AssessReadabilityAndRewrite()
loaded_program.load('compiled_assess_readability_and_rewrite.json')